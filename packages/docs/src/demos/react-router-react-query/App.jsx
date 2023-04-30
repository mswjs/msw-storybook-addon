import React from 'react';
import { Switch, Route, NavLink } from 'react-router-dom';

import Films from './pages/films/Films';
import Film from './pages/film/Film';
import Characters from './pages/characters/Characters';
import Character from './pages/character/Character';
import Home from './pages/Home';

export function App() {
  return (
    <div className="rr-rq-app">
      <nav className="rr-rq-navbar">
        <NavLink activeClassName="active" exact to="/">Home</NavLink>
        <NavLink activeClassName="active" exact to="/films">Films</NavLink>
        <NavLink activeClassName="active" exact to="/characters">Characters</NavLink>
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
