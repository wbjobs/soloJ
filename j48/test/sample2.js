const message = 'Hello World';
console.log(message);

let count = 0;
count++;
count += 1;

const PI = 3.14159;

const user = {
  name: 'John',
  age: 30
};

user.age = 31;

for (let key in user) {
  console.log(key, user[key]);
}

const numbers = [1, 2, 3, 4, 5];
let sum = 0;

for (let num of numbers) {
  sum += num;
}

console.log('Sum:', sum);