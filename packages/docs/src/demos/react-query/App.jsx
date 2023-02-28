import React from 'react';
import { useQuery } from 'react-query';

import { FilmCard } from '../../components/FilmCard';

function fetchFilms() {
  return fetch('https://swapi.dev/api/films/')
    .then((res) => {
      if (!res.ok) {
        throw new Error(res.statusText);
      }
      return res;
    })
    .then((res) => res.json())
    .then((data) => data.results);
}

function useFetchFilms() {
  const { status, data } = useQuery('films', fetchFilms);

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
    <div className="films-grid">
      {films.map((film) => (
        <FilmCard key={film.episode_id} film={film} />
      ))}
    </div>
  );
}
