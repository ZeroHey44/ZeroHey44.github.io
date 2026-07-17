document.addEventListener('DOMContentLoaded', function () {
    var emailButton = document.querySelector('[data-copy-email]');
    if (!emailButton) return;

    var resetTimer = null;
    var defaultLabel = emailButton.textContent;

    function fallbackCopy(text) {
        var textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.setAttribute('readonly', '');
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();

        var copied = document.execCommand('copy');
        textArea.remove();
        return copied;
    }

    function showCopyState(label, succeeded) {
        window.clearTimeout(resetTimer);
        emailButton.textContent = label;
        emailButton.classList.toggle('is-copied', succeeded);

        resetTimer = window.setTimeout(function () {
            emailButton.textContent = defaultLabel;
            emailButton.classList.remove('is-copied');
        }, 1800);
    }

    emailButton.addEventListener('click', function () {
        var email = emailButton.getAttribute('data-copy-email');

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(email).then(function () {
                showCopyState('已复制邮箱', true);
            }).catch(function () {
                var copied = fallbackCopy(email);
                showCopyState(copied ? '已复制邮箱' : '复制失败', copied);
            });
            return;
        }

        var copied = fallbackCopy(email);
        showCopyState(copied ? '已复制邮箱' : '复制失败', copied);
    });
});
