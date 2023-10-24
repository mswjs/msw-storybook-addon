import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import { fetch } from '../../utils';

export default function Character() {
  const { characterId } = useParams();
  const { status, data } = useQuery(`character-${characterId}`, () =>
    fetch(`https://swapi.dev/api/people/${characterId}/`),
  );

  if (status === 'loading') return <p>Loading...</p>;
  if (status === 'error') return <p>Error :(</p>;

  const homeworldUrlParts = data.homeworld.split('/').filter(Boolean);
  const homeworldId = homeworldUrlParts[homeworldUrlParts.length - 1];

  if (status !== 'success') {
    return null;
  }
  return (
    <div>
      <h2>{data.name}</h2>
      <table className="rr-rq-table" aria-label="simple table">
        <thead>
          <tr>
            <th>Feature</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Born</td>
            <td>{data.birth_year}</td>
          </tr>
          <tr>
            <td>Eyes</td>
            <td>{data.eye_color}</td>
          </tr>
          <tr>
            <td>Hair</td>
            <td>{data.hair_color}</td>
          </tr>
          <tr>
            <td>Height</td>
            <td>{data.height}</td>
          </tr>
          <tr>
            <td>Mass</td>
            <td>{data.mass}</td>
          </tr>
          <tr>
            <td>Homeworld</td>
            <td>
              <Homeworld id={homeworldId} />
            </td>
          </tr>
        </tbody>
      </table>
      <br />
      <h3>Films</h3>
      {data.films.map((film) => {
        const filmUrlParts = film.split('/').filter(Boolean);
        const filmId = filmUrlParts[filmUrlParts.length - 1];
        return <Film id={filmId} key={`Film-${filmId}`} />;
      })}
    </div>
  );
}

function Film(props) {
  const { id } = props;
  const { data, status } = useQuery(`film-${id}`, () =>
    fetch(`https://swapi.dev/api/films/${id}/`),
  );

  if (status !== 'success') {
    return null;
  }
  return (
    <article key={id}>
      <Link to={`/films/${id}`}>
        <h4>
          {data.episode_id}. {data.title}
        </h4>
      </Link>
    </article>
  );
}

function Homeworld(props) {
  const { id } = props;
  const { data, status } = useQuery(`homeworld-${id}`, () =>
    fetch(`https://swapi.dev/api/planets/${id}/`),
  );

  if (status !== 'success' && status !== 'error') {
    return null;
  }

  if (status === 'error') {
    return 'error!';
  }

  return data.name;
}
