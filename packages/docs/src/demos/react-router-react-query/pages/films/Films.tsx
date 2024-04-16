import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { fetch } from '../../utils';

export default function Films() {
  const { data, status } = useQuery('films', () => fetch('https://swapi.dev/api/films/'));

  if (status === 'loading') {
    return <p>Loading...</p>;
  }
  if (status === 'error') {
    return <p>Error :(</p>;
  }

  return (
    <div>
      <h2>Films</h2>
      {data.results.map((film: any) => {
        const filmUrlParts = film.url.split('/').filter(Boolean);
        const filmId = filmUrlParts[filmUrlParts.length - 1];
        return (
          <article key={filmId}>
            <Link to={`/films/${filmId}`}>
              <h4>
                {film.episode_id}. {film.title}{' '}
                <em>({new Date(Date.parse(film.release_date)).getFullYear()})</em>
              </h4>
            </Link>
          </article>
        );
      })}
    </div>
  );
}
