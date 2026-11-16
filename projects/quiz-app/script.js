const questions = [
    {
        question: "What does the median represent in statistics?",
        answer: [
            { text: "The most frequent value in a dataset", correct: false },
            { text: "The middle value when data is ordered", correct: true },
            { text: "The average value of a dataset", correct: false },
            { text: "The range of a dataset", correct: false }
        ]
    },
    {
        question: "In insertion sort, which element is picked first for comparison?",
        answer: [
            { text: "The last element of the array", correct: false },
            { text: "The first element of the array", correct: false },
            { text: "The second element of the array", correct: true },
            { text: "A random element", correct: false }
        ]
    },
    {
        question: "Which JavaScript keyword is used to declare a variable that cannot be reassigned?",
        answer: [
            { text: "var", correct: false },
            { text: "let", correct: false },
            { text: "const", correct: true },
            { text: "define", correct: false }
        ]
    },
    {
        question: "What is the time complexity of binary search in the worst case?",
        answer: [
            { text: "O(n)", correct: false },
            { text: "O(log n)", correct: true },
            { text: "O(n log n)", correct: false },
            { text: "O(1)", correct: false }
        ]
    },
    {
        question: "Which sentence is grammatically correct?",
        answer: [
            { text: "She don’t like coffee", correct: false },
            { text: "She doesn’t likes coffee", correct: false },
            { text: "She doesn’t like coffee", correct: true },
            { text: "She don’t likes coffee", correct: false }
        ]
    },
    {
        question: "What does typeof null return in JavaScript?",
        answer: [
            { text: '"null"', correct: false },
            { text: '"object"', correct: true },
            { text: '"undefined"', correct: false },
            { text: '"number"', correct: false }
        ]
    },
    {
        question: "Which measure of central tendency is most affected by extreme values?",
        answer: [
            { text: "Median", correct: false },
            { text: "Mode", correct: false },
            { text: "Mean", correct: true },
            { text: "Range", correct: false }
        ]
    },
    {
        question: "Which data structure works on the principle of FIFO?",
        answer: [
            { text: "Stack", correct: false },
            { text: "Tree", correct: false },
            { text: "Queue", correct: true },
            { text: "Graph", correct: false }
        ]
    },
    {
        question: "What is the capital of Germany?",
        answer: [
            { text: "Munich", correct: false },
            { text: "Frankfurt", correct: false },
            { text: "Berlin", correct: true },
            { text: "Hamburg", correct: false }
        ]
    },
    {
        question: "Which of the following is NOT a looping structure in JavaScript?",
        answer: [
            { text: "for loop", correct: false },
            { text: "while loop", correct: false },
            { text: "repeat-until loop", correct: true },
            { text: "do...while loop", correct: false }
        ]
    }
];
const questionEle = document.getElementById("question")
const answerButtons = document.getElementById("answer-buttons")
const nextButton = document.getElementById("next-btn")

let currentQuestionIndex = 0;
let score = 0
function startQuiz() {
    currentQuestionIndex = 0;
    score = 0;
    nextButton.innerHTML = "Next";
    showQuestion();
}
function showQuestion() {
    resetState();
    let currentQuestion = questions[currentQuestionIndex];
    let questionNo = currentQuestionIndex + 1
    questionEle.innerHTML = questionNo + ". " + currentQuestion.question;

    currentQuestion.answer.forEach(answer => {
        const button = document.createElement("button")
        button.innerHTML = answer.text;
        button.classList.add("btn")
        answerButtons.appendChild(button)
        if (answer.correct) {
            button.dataset.correct = answer.correct;
        }
        button.addEventListener("click", selectAnswer);
    });

}
function resetState() {
    nextButton.style.display = "none";
    while (answerButtons.firstChild) {
        answerButtons.removeChild(answerButtons.firstChild);
    }
}
function selectAnswer(e) {
    const selectedBtn = e.target;
    const iscorrect = selectedBtn.dataset.correct === "true";
    if (iscorrect) {
        selectedBtn.classList.add("correct")
        score++
    } else {
        selectedBtn.classList.add("incorrect")
    }
    Array.from(answerButtons.children).forEach(button => {
        if (button.dataset.correct === "true") {
            button.classList.add("correct")
        }
        button.disabled = true;
    })
    nextButton.style.display = "block";



}
function showScore() {
    resetState();
    questionEle.innerHTML = `You scored ${score} out of ${questions.length}`;
    nextButton.innerHTML = "Play Again";
    nextButton.style.display = "block";
}
function handleNextButton() {
    currentQuestionIndex++;
    if (currentQuestionIndex < questions.length) {
        showQuestion();
    } else {
        showScore();
    }
}
nextButton.addEventListener("click", () => {
    if (currentQuestionIndex < questions.length) {
        handleNextButton();
    } else {
        startQuiz()
    }
})

startQuiz()
