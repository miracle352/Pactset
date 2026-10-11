type Review = {
  id: string;
  rating: number;
  body: string;
  response_body: string | null;
  moderation_status: string;
  created_at: string;
};

export function ProviderReputation({ reviews, failed = false }: { reviews: Review[]; failed?: boolean }) {
  if (failed) return <section className="workspace-section"><div className="compact-section-heading"><h2>Verified booking feedback</h2></div><div className="data-error" role="alert"><strong>Feedback could not load.</strong><p>Your booking history is unchanged. Refresh to try again.</p></div></section>;
  const published = reviews.filter((review) => review.moderation_status === "published");
  const average = published.length ? published.reduce((sum, review) => sum + review.rating, 0) / published.length : null;
  return <section className="workspace-section" aria-labelledby="verified-feedback-heading">
    <div className="compact-section-heading"><div><h2 id="verified-feedback-heading">Verified booking feedback</h2><p>Only feedback tied to confirmed completed Pactset work appears here.</p></div>{average !== null && <strong className="rating-summary">{average.toFixed(1)} / 5 · {published.length} review{published.length === 1 ? "" : "s"}</strong>}</div>
    {published.length ? <div className="record-list">{published.slice(0, 5).map((review) => <article key={review.id} className="review-history-item"><div><strong>{review.rating} / 5</strong><p>{review.body}</p>{review.response_body && <small>Your response: {review.response_body}</small>}</div><time dateTime={review.created_at}>{new Date(review.created_at).toLocaleDateString()}</time></article>)}</div> : <p className="empty-inline">No verified feedback yet. Reviews become available only after a booking is completed on Testnet.</p>}
  </section>;
}
