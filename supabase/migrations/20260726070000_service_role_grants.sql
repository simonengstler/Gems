begin;

grant all on
  public.users,
  public.groups,
  public.group_members,
  public.rounds,
  public.submissions,
  public.ratings,
  public.group_settings,
  public.group_invitations,
  public.notification_log,
  public.push_subscriptions
to service_role;

commit;
