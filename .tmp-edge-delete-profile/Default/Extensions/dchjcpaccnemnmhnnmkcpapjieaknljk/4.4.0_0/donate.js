const donateButtons = document.querySelectorAll('button[data-amount]');
const customDonateButton = document.getElementById('customDonate');
const customAmountInput = document.getElementById('customAmount');

async function createCheckoutSession(amount) {
    try {
        const res = await fetch('https://rayva28a6b.execute-api.us-east-2.amazonaws.com/Prod/donate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount })
        });
        const data = await res.json();

        if (!res.ok) {
            console.error('Backend error', data, res);
            window.location.href = 'cancel.html'
            return;
        }
        if (data.url) {
            window.location.href = data.url;
        } else {
            console.error('Unexpected response', data);
            window.location.href = 'cancel.html'
        }
    } catch (err) {
        console.error('Network or CORS error — check console:', err);
        window.location.href = 'cancel.html'
    }
}

donateButtons.forEach(button => {
    button.addEventListener('click', () => {
        const amount = parseInt(button.getAttribute('data-amount'), 10);
        createCheckoutSession(amount);
    });
});

customDonateButton.addEventListener('click', () => {
    const amount = parseInt(customAmountInput.value, 10);
    if (amount && amount >= 1) {
        createCheckoutSession(amount);
    } else {
        alert('Please enter a valid amount.');
    }
});
