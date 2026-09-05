from scraper.discover import discover_posts


HTML = """
<a href="https://www.davaolight.com/post/scheduled-power-interruption-on-september-8-in-davao-city">
  <div data-hook="post-list-item__title"><h2>Scheduled power interruption on September 8 in Davao City</h2></div>
</a>
<a href="https://www.davaolight.com/post/invitation-to-bid-reroofing">
  <h2>INVITATION TO BID: Reroofing of Annex Building</h2>
</a>
"""


def test_discover_filters_keywords_and_dedupes():
    posts = discover_posts(HTML + HTML)
    assert len(posts) == 1
    assert posts[0]["source_url"].endswith("september-8-in-davao-city")
