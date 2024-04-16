export function FilmCard({
  film
}: any) {
  return (
    <article className="film-card">
      <h4 className="film-title">{film.title}</h4>
      <p>{film.opening_crawl}</p>
    </article>
  );
}
