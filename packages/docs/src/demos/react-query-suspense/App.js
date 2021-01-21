import React, { Suspense } from 'react';
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

function FilmsGrid() {
  const { data: films } = useQuery('films', fetchFilms);

  return (
    <div className="films-grid">
      {films.map((film) => (
        <FilmCard key={film.episode_id} film={film} />
      ))}
    </div>
  );
}

export function App() {
  return (
    <Suspense fallback={<p>Fetching Star Wars data...</p>}>
      <FilmsGrid />
    </Suspense>
  );
}
