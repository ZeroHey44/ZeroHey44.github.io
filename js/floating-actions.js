document.addEventListener('DOMContentLoaded', function () {
    var topButton = document.querySelector('.IconToTop');
    var topLink = topButton ? topButton.closest('a') : null;
    var pageScrollCue = document.querySelector('.page-scroll-cue');

    function updateBackTopState() {
        document.body.classList.toggle('show-back-top', window.scrollY > 260);
        if (pageScrollCue) {
            var pageHeight = Math.max(
                document.documentElement.scrollHeight,
                document.body.scrollHeight
            );
            var maximumScroll = Math.max(0, pageHeight - window.innerHeight);
            var isAtPageBottom = maximumScroll <= 12 || window.scrollY >= maximumScroll - 12;

            pageScrollCue.classList.toggle('is-hidden', isAtPageBottom);
        }
    }

    if (topLink) {
        topLink.addEventListener('click', function (event) {
            event.preventDefault();
            var target = document.querySelector('#PageTop');

            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }

    if (pageScrollCue) {
        pageScrollCue.addEventListener('click', function (event) {
            var scrollPages = Array.prototype.slice.call(document.querySelectorAll(
                '.snap-section, .concept-intro, .work-card, .photo-card, .empty-state'
            )).filter(function (element) {
                return element.offsetParent !== null;
            });

            if (!scrollPages.length) return;

            event.preventDefault();

            var viewportCenter = window.innerHeight * 0.5;
            var currentIndex = -1;
            var pageRects = scrollPages.map(function (element) {
                return element.getBoundingClientRect();
            });

            for (var index = 0; index < pageRects.length; index += 1) {
                if (pageRects[index].top <= viewportCenter && pageRects[index].bottom > viewportCenter) {
                    currentIndex = index;
                }
            }

            var nextPage = currentIndex >= 0 ? scrollPages[currentIndex + 1] : null;

            if (!nextPage) {
                for (var nextIndex = 0; nextIndex < pageRects.length; nextIndex += 1) {
                    var pageCenter = (pageRects[nextIndex].top + pageRects[nextIndex].bottom) * 0.5;
                    if (pageCenter > viewportCenter + 10) {
                        nextPage = scrollPages[nextIndex];
                        break;
                    }
                }
            }

            if (nextPage) {
                var centerPage = nextPage.matches('.work-card, .photo-card');
                nextPage.scrollIntoView({
                    behavior: 'smooth',
                    block: centerPage ? 'center' : 'start'
                });
            } else {
                window.scrollTo({
                    top: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
                    behavior: 'smooth'
                });
            }
        });
    }

    updateBackTopState();
    window.addEventListener('scroll', updateBackTopState, { passive: true });
    window.addEventListener('resize', updateBackTopState, { passive: true });
    window.addEventListener('pageshow', updateBackTopState);
});
