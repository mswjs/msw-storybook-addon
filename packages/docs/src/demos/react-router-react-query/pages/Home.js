import React from 'react';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div>
      <h2>React Router + React Query</h2>
      <p>
        Using the Star Wars app originally built by{' '}
        <a href="https://twitter.com/Brent_m_Clark">@Brent_m_Clark</a>
      </p>
      <section>
        <h3>Purpose</h3>
        <p>
          By mocking the API calls with my addon you can bring more parts of your app into Storybook than just reusable leaf components.
        </p>
        <ol>
          <li>
            Whole App but it will need lot of mocks (Not Recommended)
          </li>
          <li>
            Subsection of App like only <strong>/films/1</strong> page by passing initial location to MemoryRouter.
          </li>
          <li>
            Isolated Page components by creating individual stories like <strong>Film.stories.js</strong>. (Good Start)
          </li>
        </ol>
        <h3>Ready to get started?</h3>
        <p>
          Check out the <Link to="/films">Films</Link> and <Link to="/characters">Characters</Link>!
        </p>
      </section>
    </div>
  );
}
