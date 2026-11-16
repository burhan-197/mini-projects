let checkboxlist = document.querySelectorAll('.check-box')
let goalsection = document.querySelector('.goal-section')
let errorlabel = document.querySelector('.error-label')
let goalinput = document.querySelectorAll('.goal-input')
let progressbar = document.querySelector('.progress')

const allgoals = JSON.parse(localStorage.getItem('allGoals')) || {}

function progress() {
    let completedcount = 0;

    checkboxlist.forEach((checkbox) => {
        if (checkbox.parentElement.classList.contains('completed')) {
            completedcount++
        }
    })
    let percentage = (completedcount / checkboxlist.length) * 100;

    progressbar.style.width = percentage + '%';

    progressbar.textContent = `${completedcount}/${checkboxlist.length} completed`
    if (completedcount == 3) {
        confetti()
    }

}




checkboxlist.forEach((checkbox) => {

    checkbox.addEventListener('click', () => {
        const input = checkbox.nextElementSibling;
        if (input.value.trim() === '') {
            errorlabel.style.display = 'block';

        } else {
            checkbox.parentElement.classList.toggle('completed')
            progress()
            const inputId = checkbox.nextElementSibling.id
            allgoals[inputId].completed = !allgoals[inputId].completed
            localStorage.setItem('allGoals', JSON.stringify(allgoals))

            let allfilled = true;
            for (let i = 0; i < checkboxlist.length; i++) {
                if (checkboxlist[i].nextElementSibling.value.trim() === '') {
                    allfilled = false
                    break;
                }
            }
            if (allfilled) {
                errorlabel.style.display = 'none'
            } else {
                errorlabel.style.display = 'block'
            }
        }

    })

})
goalinput.forEach((input) => {
    const goalId = input.id;

    if (allgoals[goalId]) {
        input.value = allgoals[goalId].name;

        if (allgoals[goalId].completed) {
            input.parentElement.classList.add('completed');
        }
    } else {

        allgoals[goalId] = {
            name: input.value || '',
            completed: false
        };
    }

    input.addEventListener('input', (e) => {
        const currentCompletedStatus = allgoals[goalId] ? allgoals[goalId].completed : false;

        allgoals[goalId] = {
            name: input.value,
            completed: currentCompletedStatus,
        }
        localStorage.setItem('allGoals', JSON.stringify(allgoals))
    })
})
progress()