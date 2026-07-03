document.addEventListener('DOMContentLoaded', function () {
    var topButton = document.querySelector('.IconToTop');
    var topLink = topButton ? topButton.closest('a') : null;

    function updateBackTopState() {
        document.body.classList.toggle('show-back-top', window.scrollY > 260);
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

    updateBackTopState();
    window.addEventListener('scroll', updateBackTopState, { passive: true });
});
