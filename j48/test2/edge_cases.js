const result = [];
for (var i = 0; i < 10; i++) {
  result.push(i);
}
console.log('Last i:', i);
const items = [1, 2, 3];
for (let idx in items) {
  console.log(idx);
}
const config = {
  x: 1,
  y: 2
};
for (let key in config) {
  console.log(key, config[key]);
}
for (let num of items) {
  console.log(num);
}
let a = 1;
const b = 2;
a = 10;
function test() {
  let x = 1;
  const y = 2;
  x = 3;
  return x + y;
}
console.log(z);
var z = 42;