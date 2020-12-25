import { tw } from 'twind';

export function FilmCard({ film }) {
  return (
    <article className={tw`w-72 bg-indigo-100 rounded-md border-2 border-indigo-200 px-4 py-5`}>
      <h4 className={tw`font-bold text-blue-800 text-2xl mb-3`}>{film.title}</h4>
      <p>{film.opening_crawl}</p>
    </article>
  );
}
