export function electionIsLive(election: { status: string; starts_at: string; ends_at: string }) {
  const now = new Date();
  const startsAt = new Date(election.starts_at);
  const endsAt = new Date(election.ends_at);

  return election.status === "live" && now >= startsAt && now <= endsAt;
}
