import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { fetch } from '../../utils';

export default function Characters() {
  const { status, data } = useQuery('characters', () =>
    fetch(`https://swapi.dev/api/people/`),
  );

  if (status === 'loading') return <p>Loading...</p>;
  if (status === 'error') return <p>Error :(</p>;

  return (
    <div>
      <h2>Characters</h2>
      {data.results.map((person) => {
        const personUrlParts = person.url.split('/').filter(Boolean);
        const personId = personUrlParts[personUrlParts.length - 1];
        return (
          <article key={personId}>
            <Link to={`/characters/${personId}`}>
              <h4>{person.name}</h4>
            </Link>
          </article>
        );
      })}
    </div>
  );
}
