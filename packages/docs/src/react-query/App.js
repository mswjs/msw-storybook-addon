import React from 'react';
import { useQuery } from 'react-query';

import { Columns } from '../components/Layout';
import { FilmCard } from '../components/FilmCard';

function useFetchFilms() {
  const { status, data } = useQuery('films', () => {
    return fetch('https://swapi.dev/api/films/')
      .then((res) => res.json())
      .then((data) => data.results);
  });

  return {
    status,
    films: data,
  };
}

export function App() {
  const { status, films } = useFetchFilms();

  if (status === 'loading') {
    return <p>Fetching Star Wars data...</p>;
  }

  if (status === 'error') {
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
