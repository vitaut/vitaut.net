---
title: Migrating from Blogger to GitHub Pages
date: 2012-12-14
aliases: ['/2012/12/14/migrating-from-blogger-to-github-pages.html']
---

I've just migrated from [Blogger](http://www.blogger.com/) to
[GitHub Pages](http://pages.github.com/). This is the first post
that I'm writing using the new platform.

The main reason for migration was that I wanted to write my posts in a
[lightweight markup language](http://en.wikipedia.org/wiki/Lightweight_markup_language)
such as [Markdown](http://en.wikipedia.org/wiki/Markdown) or
[reStructured Text](http://en.wikipedia.org/wiki/ReStructuredText).
In Blogger I had to either use a WYSIWYG editor which is OK for simple posts
but not for advanced stuff such as code snippets or formulas, or an HTML
editor.

GitHub Pages have additional advantages:

* All the posts and the change history are stored in a Git repository which
  usually exists in at least two places, on a GitHub server and locally.
  Each can act as a full backup.

* There is a clear mapping between the content of the repository and the
  site. Even though I am using it for just over a day I can open any of my
  posts in a browser, click View Source (HTML) and say where every last
  piece of HTML has come from. This makes configuration simple, if I need
  to change anything I immediately know where to go.

* Now I can use the same tools for writing my posts that I've been using for
  development.

There are some disadvantages as well:

* You have to add yourself many of the things that are readily available on
  Blogger: comments, analytics, tags. Fortunately it is not that difficult.

* Error messages could be more informative:

  > The page build failed with the following error:
  > page build failed

* The documentation seems to be spread out between various places, namely
  [GitHub Pages](http://pages.github.com/),
  [Jekyll](https://github.com/mojombo/jekyll) and
  [Liquid](http://liquidmarkup.org/).

I used [this script](https://gist.github.com/1506614) by
[ngauthier](https://github.com/ngauthier) to convert my posts.
It mostly did the job although I had to do a little bit of manual cleanup.
