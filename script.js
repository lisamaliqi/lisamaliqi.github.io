
// DOM elements
const clockEl = document.querySelector('.clock');



// Function for clock
const clock = () => {
    const now = new Date();
    clockEl.innerText = now.toLocaleTimeString(); 
};



// Call the clock function but also interval so it updates itself
setInterval(clock, 500);
clock();


