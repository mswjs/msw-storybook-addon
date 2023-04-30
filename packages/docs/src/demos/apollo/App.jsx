import React from 'react';
import { useQuery, gql } from '@apollo/client';

import { FilmCard } from '../../components/FilmCard';

const AllFilmsQuery = gql`
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
  const { loading, error, data } = useQuery(AllFilmsQuery);

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
