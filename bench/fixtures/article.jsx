import { Link } from 'inferno-router';
import { Code, Figure, Footnote } from './content';

// A long-form page, mostly text: whitespace collapsing, entities and text mixed with expressions
export function Article({post, author, related}) {
  return (
    <article className="post">
      <header className="post-header">
        <p className="post-kicker">Engineering &middot; {post.readingTime} min read</p>
        <h1 className="post-title">
          Rendering a million rows
          without dropping a frame
        </h1>
        <p className="post-byline">
          By <Link to={'/authors/' + author.slug}>{author.name}</Link>,
          published <time dateTime={post.date}>{post.formattedDate}</time>
          &mdash; updated {post.updatedAgo} ago
        </p>
      </header>

      <section className="post-body">
        <p>
          Virtual DOM libraries are often described as &ldquo;fast enough&rdquo;. That is true for most
          applications, but the moment a table grows beyond a few thousand rows, every allocation
          and every branch in the diffing loop starts to show up in the profile. In this post we
          walk through what we measured, what we changed, and what we learned along the way.
        </p>
        <p>
          The short version: the biggest wins came from doing <em>less</em> work at runtime, by
          letting the compiler decide ahead of time what shape each node has. When the compiler
          knows that an element has exactly one text child, the runtime can skip normalization
          entirely &ndash; no arrays, no type checks, no&nbsp;allocations.
        </p>

        <h2 id="measuring">Measuring first</h2>
        <p>
          We started with a synthetic benchmark of {post.rowCount.toLocaleString()} rows, each row
          containing {post.cellCount} cells. The baseline took {post.baseline} ms to render and
          {' '}{post.baselineUpdate} ms to update a single cell. Those numbers alone do not say much,
          so we also recorded allocations: {post.allocations} MB per full render.
        </p>
        <Figure src={post.images.flamegraph} caption="Flame graph of the baseline render" width={960} height={540} />
        <p>
          Most of the time was spent in three places:
        </p>
        <ol>
          <li>Normalizing children arrays that were already normalized.</li>
          <li>
            Creating text nodes for strings that never changed &mdash; the classic
            &quot;static content&quot; problem.
          </li>
          <li>Checking the type of every child on every update, even when the shape was known.</li>
        </ol>

        <h2 id="flags">Letting the compiler help</h2>
        <p>
          Inferno&rsquo;s JSX plugin already emits child flags such as <Code>HasVNodeChildren</Code> and
          {' '}<Code>HasTextChildren</Code>. When they are present the runtime trusts them. The catch is
          that dynamic children &ndash; anything inside <Code>{'{curly braces}'}</Code> &ndash; can be
          anything, so the compiler has to fall back to <Code>UnknownChildren</Code>:
        </p>
        <pre className="code-block">
          <code>{post.snippets.flags}</code>
        </pre>
        <p>
          You can tell the compiler more with the <Code>$HasKeyedChildren</Code> and
          {' '}<Code>$HasTextChildren</Code> hints{Footnote({id: 1})}. We added them to the row and
          cell components, which removed normalization from the hot path:
          render time dropped to {post.optimized} ms and allocations to {post.optimizedAllocations} MB.
        </p>
        <blockquote cite={post.quoteSource}>
          <p>
            &ldquo;The fastest code is the code that never runs. The second fastest is the code the
            compiler ran for you.&rdquo;
          </p>
          <footer>&mdash; {post.quoteAuthor}</footer>
        </blockquote>

        <h2 id="results">Results</h2>
        <table className="results">
          <thead>
            <tr>
              <th scope="col">Scenario</th>
              <th scope="col">Before</th>
              <th scope="col">After</th>
              <th scope="col">Change</th>
            </tr>
          </thead>
          <tbody>
            {post.results.map((result) => (
              <tr key={result.name}>
                <td>{result.name}</td>
                <td>{result.before} ms</td>
                <td>{result.after} ms</td>
                <td className={result.after < result.before ? 'better' : 'worse'}>
                  {Math.round((result.after / result.before - 1) * 100)}&thinsp;%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          None of this required changes to application logic. The components look the same,
          they just carry a little more information for the compiler &ndash; and the compiler
          turns that information into cheaper code.
        </p>
      </section>

      <aside className="post-related">
        <h2>Related posts</h2>
        <ul>
          {related.map((item) => (
            <li key={item.slug}>
              <Link to={'/posts/' + item.slug}>{item.title}</Link>
              <span className="muted"> &middot; {item.readingTime} min</span>
            </li>
          ))}
        </ul>
      </aside>

      <footer className="post-footer">
        <p>
          Questions or corrections? Open an issue on{' '}
          <a href="https://github.com/infernojs/inferno" rel="noopener noreferrer" target="_blank">GitHub</a>
          {' '}or reach us on the forum. &copy; {new Date().getFullYear()} The Inferno authors.
        </p>
      </footer>
    </article>
  );
}
