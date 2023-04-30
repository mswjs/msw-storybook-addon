import React from 'react';
import { useQuery } from 'urql';

import { FilmCard } from '../../components/FilmCard';

const AllFilmsQuery = `
  query AllFilmsQuery {
    allFilms {
      films {
        title
        episode_id: episodeID
        opening_crawl: openingCrawl
      }
    }
  }
`;

function useFetchFilms() {
  const [{ fetching, error, data }] = useQuery({
    query: AllFilmsQuery,
  });

  const loading = fetching;
  const films = data ? data.allFilms.films : [];

  return { loading, error, films };
}

export function App() {
  const { loading, error, films } = useFetchFilms();

  if (loading) {
    return <p>Fetching Star Wars data...</p>;
  }

  if (error) {
    return <p>Could not fetch Star Wars data</p>;
  }

  return (
    <div className="films-grid">
      {films.map((film) => (
        <FilmCard key={film.episode_id} film={film} />
      ))}
    </div>
  );
}
