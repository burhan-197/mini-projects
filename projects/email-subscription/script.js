const scriptURL = 'https://script.google.com/macros/s/AKfycbzqYiUzqUMJxhX57mV_CmJ2e5ggi8qcAwdKgYarTy12sQ_ihESlMePD-UfVPXBC0wc_/exec'
const form = document.forms['email-subscription']

form.addEventListener('submit', e => {
    e.preventDefault()
    fetch(scriptURL, { method: 'POST', body: new FormData(form) })
        .then(response => response.json())
        .then(response => console.log('Success!', response),

            document.querySelector('.message').style.display = 'block',
            form.reset(),
            setTimeout(() => {
                document.querySelector('.message').style.display = 'none';
            }, 5000))
        .catch(error => console.error('Error!', error.message))
})