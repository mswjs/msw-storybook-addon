import React from 'react';
import { Link } from 'react-router-dom';
import { withRouter } from 'react-router';
import { useQuery } from 'react-query';
import { fetch } from '../../utils';

function Film(props) {
  const filmId = props.match.params.filmId;
  const { data, status } = useQuery(`film-${filmId}`, () =>
    fetch(`https://swapi.dev/api/films/${filmId}/`),
  );

  if (status === 'loading') return <p>Loading...</p>;
  // this will not be necessary when v1 is released.
  if (data == null) {
    console.info("this shouldn't happen but it does 2");
    return <p>Loading...</p>;
  }
  if (status === 'error') return <p>Error :(</p>;
  return (
    <div>
      <h2>{data.title}</h2>
      <p>{data.opening_crawl}</p>
      <br />
      <h3>Characters</h3>
      {data.characters.map((character) => {
        const characterUrlParts = character.split('/').filter(Boolean);
        const characterId = characterUrlParts[characterUrlParts.length - 1];
        return <Character id={characterId} key={characterId} />;
      })}
    </div>
  );
}

function Character(props) {
  const { id } = props;
  const { data, status } = useQuery(`character-${id}`, () =>
    fetch(`https://swapi.dev/api/people/${props.id}/`),
  );

  if (status !== 'success') {
    return null;
  }

  return (
    <article key={id}>
      <Link to={`/characters/${id}`}>
        <h4>{data.name}</h4>
      </Link>
    </article>
  );
}

export default withRouter(Film);
