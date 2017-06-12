# clay-build-js

Build JS for your Clay components.

## Installation

```
npm install --save clay-build-js
```


## Usage

### Clay-cli

```
clay build-js
```

### Programmatic

```
const buildJs = require('clay-build-js');

buildJs({
  // defaults
  watch: false,
  debug: false,
  verbose: false
})
```

## What this does:

* For each component's model and component JS file, creates a corresponding Javascript chunk file in `public/js` using [browserify-splitter](https://www.npmjs.com/package/browserify-splitter). These chunks can be combined arbitrarily by resolve-media within the context of a bundle.
* Exported JS is minified using uglify and transpiled using Babel.
* Exports `client-env.json`, which is an array of all env vars used

## Options

* watch: Boolean. Default: `false`. Watch for changes.
* verbose: Boolean. Default: `false`. Log all files written.
* debug: Boolean. Default: `false`. Disable `bundle-collapser` and `uglifyify`, allowing for easier debugging and faster builds.
* preBundle: Function. Receives the Browserify bundler as the first argument and runs before bundling. Allows you to add additional dependencies, transforms, and plugins.
* babelConf: Object. Configuration object for Babel.

## Advanced Explanation

Usually, the JavaScript that any page needs is known beforehand, by the developer. For example, you might include a `homepage.js` script on your homepage and a `section.js` script on your section pages.

In Clay, a page is made up entirely of arbitrary data -- components. Some components need client-side  JavaScript. Any page could theoretically have any combination of components.

So how do we get all the client.js that a page needs on to the page itself? The solution should:

* Be scalable. It should work with hundreds of components. So we can't simply include all of our client-side Javascript on all of our pages.
* Be performant on the server. The server shouldn't have to do a lot of legwork to generate pages with the right JS.
* Be performant on the client. The client shouldn't have to perform dozens of asynchronous requests to fetch missing JS. The code should be minified.
* Be convenient for devs. Devs shouldn't have to wait long to see their changes compiled.
* Enables universal code. That means some `require` should work client-side and ES6 should be transpiled to ES5.

Clay-build-js resolves all these issues. It scans your Clay installation for component JS, traces their dependencies, and arranges those dependencies into a bundle via [Browserify](http://browserify.org/), but splits that bundle into separate chunks using [browserify-splitter](https://www.npmjs.com/package/browserify-splitter). It also extracts a dependency registry with [browserify-extract-registry](https://www.npmjs.com/package/browserify-extract-registry), transpiles to ES5 using Babel, and uglifies.

When Clay generates a page, it detects the components that a page contains, determines which module chunks the components need using the registry clay-build-js exported, and includes only those chunks on the page, nesting them in a context in which `require` works. As a result, a Clay server can effectively generate valid bundles on-the-fly without compromising performance.


