import React from 'react';
import { Switch, Route, Link } from 'react-router-dom';

import Films from './pages/films/Films';
import Film from './pages/film/Film';
import Characters from './pages/characters/Characters';
import Character from './pages/character/Character';
import Home from './pages/Home';

export function App() {
  return (
    <div className="App">
      <nav className="navbar" style={{ display: 'flex', gap: '20px' }}>
        <Link to="/">Home</Link>
        <Link to="/films">Films</Link>
        <Link to="/characters">Characters</Link>
      </nav>
      <main>
        <Switch>
          <Route exact path="/films">
            <Films />
          </Route>
          <Route exact path="/films/:filmId">
            <Film />
          </Route>
          <Route exact path="/characters">
            <Characters />
          </Route>
          <Route exact path="/characters/:characterId">
            <Character />
          </Route>
          <Route path="/">
            <Home />
          </Route>
        </Switch>
      </main>
    </div>
  );
}
