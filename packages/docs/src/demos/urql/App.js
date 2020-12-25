import React from 'react';
import { useQuery } from 'urql';

import { Columns } from '../../components/Layout';
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

  const films = data ? data.allFilms.films : [];

  return { fetching, error, films };
}

export function App() {
  const { fetching, error, films } = useFetchFilms();

  if (fetching) {
    return <p>Fetching Star Wars data...</p>;
  }

  if (error) {
    return <p>Could not fetch Star Wars data</p>;
  }

  return (
    <Columns>
      {films.map((film) => (
        <FilmCard key={film.episode_id} film={film} />
      ))}
    </Columns>
  );
}
