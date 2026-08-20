-- Security backstop: dm_threads, dm_messages, meeting_cohosts, and
-- org_affiliations were created (migrations 00010/00011) without RLS.
-- Every server action already reads/writes them through the service-role
-- client after doing its own manual authorization check, so this isn't
-- fixing an active hole in normal app usage -- it's the missing safety
-- net for the moment some future code path (or a client component that
-- gets refactored to query directly) uses the anon/authenticated client
-- against these tables instead. Policies mirror the authorization checks
-- already enforced in app code, not new business rules.

ALTER TABLE public.dm_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_cohosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_affiliations ENABLE ROW LEVEL SECURITY;

-- dm_threads: only the two participants can see or touch a thread
-- (mirrors requestDm/respondDm/sendDm in app/(app)/messages/actions.ts).
CREATE POLICY "dm_threads_participant_read" ON public.dm_threads FOR SELECT USING (
  auth.uid() = user_a OR auth.uid() = user_b
);
CREATE POLICY "dm_threads_participant_insert" ON public.dm_threads FOR INSERT WITH CHECK (
  auth.uid() = initiated_by AND (auth.uid() = user_a OR auth.uid() = user_b)
);
CREATE POLICY "dm_threads_participant_update" ON public.dm_threads FOR UPDATE USING (
  auth.uid() = user_a OR auth.uid() = user_b
);

-- dm_messages: only participants of the parent thread.
CREATE POLICY "dm_messages_participant_read" ON public.dm_messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.dm_threads t
    WHERE t.id = dm_messages.thread_id AND (t.user_a = auth.uid() OR t.user_b = auth.uid())
  )
);
CREATE POLICY "dm_messages_participant_insert" ON public.dm_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND EXISTS (
    SELECT 1 FROM public.dm_threads t
    WHERE t.id = dm_messages.thread_id AND (t.user_a = auth.uid() OR t.user_b = auth.uid())
  )
);

-- meeting_cohosts: shown publicly on meeting pages (matches meeting_rsvps/
-- org_awards' public-read pattern); only staff of the hosting org manage it
-- (mirrors inviteCohost/respondCohost/removeCohost in orgs/[slug]/meetings/actions.ts).
CREATE POLICY "cohosts_public_read" ON public.meeting_cohosts FOR SELECT USING (true);
CREATE POLICY "cohosts_staff_write" ON public.meeting_cohosts FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.meetings mt
    JOIN public.org_members m ON m.org_id = mt.org_id
    WHERE mt.id = meeting_cohosts.meeting_id
    AND m.user_id = auth.uid() AND m.role IN ('director', 'officer') AND m.status = 'active'
  )
);

-- org_affiliations: shown publicly on org pages; staff of either org in the
-- pair can manage it (mirrors addAffiliation/respondAffiliation/removeAffiliation
-- in orgs/actions.ts -- app code enforces the tighter "only the target org
-- responds" rule; this is the broader backstop, not a new restriction).
CREATE POLICY "affiliations_public_read" ON public.org_affiliations FOR SELECT USING (true);
CREATE POLICY "affiliations_staff_write" ON public.org_affiliations FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.org_members m
    WHERE m.org_id IN (org_affiliations.org_id, org_affiliations.affiliate_org_id)
    AND m.user_id = auth.uid() AND m.role IN ('director', 'officer') AND m.status = 'active'
  )
);

NOTIFY pgrst, 'reload schema';
