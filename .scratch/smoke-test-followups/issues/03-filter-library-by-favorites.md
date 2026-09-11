# 03 — Make Favorites navigation filter the library

**What to build:** Make the Favorites navigation action show only favorited games, with the correct result count and usable focus when the filtered library opens.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] Selecting Favorites excludes games that are not favorited.
- [x] The result count and active filter describe the Favorites view.
- [x] Focus moves to a usable control or game when the view opens.
- [x] A focused regression check covers navigation into Favorites with mixed favorite state.

## Comments

- 2026-09-11: Claimed after resolving save-sync retry. One Luna xhigh worker per acceptance item, followed by fresh Luna xhigh verification before closing each item. Reuse the existing library favorites filter and count pipeline.
- 2026-09-11: Item 2 implemented by `s03_count_luna`, independently verified by `s03_count_verify_luna`: App passes its filter to Sidebar for mutually exclusive All Games/Favorites selection and `aria-current`; Library reuses the existing full filtered-result count before pagination. The real App navigation regression passed 1/1 and existing Library tests passed 5/5.
- 2026-09-11: Item 3 implemented by `s03_focus_luna`, independently verified by `s03_focus_verify_luna`: opening the controlled Favorites view focuses the existing search field, including when there are no games; asynchronous result refreshes do not refocus it. App and Library tests passed 6/6.
- 2026-09-11: Item 4 implemented by `s03_regression_luna`, independently verified by `s03_regression_verify_luna`: one persistent `src/App.test.jsx` regression exercises the real Sidebar/App/Library route with mixed favorite state, the backend filter request, visible exclusion/count, active navigation/filter, and search focus. The test and its formatter check passed; root's combined App/Library/GameDetails run passed 20/20.
- 2026-09-11: Item 1 implemented by `s03_filter_luna`, independently verified by `s03_filter_verify_luna`: Favorites routes into the existing filter pipeline and resets stale platform/search/page state; All Games and platform navigation leave Favorites. The persistent App test and a disposable navigation/exit check passed.

## Answer

Favorites now activates the existing library filter, excludes non-favorites, displays the filtered total and active navigation state, and focuses search. All Games/platform navigation exits the filter. One real-App regression covers the complete navigation path; each acceptance item received a Luna xhigh worker and a fresh Luna xhigh verification pass.
