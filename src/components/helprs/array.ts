export function notIncludesItemArray (array1: Array<string>, array2: Array<string>) {
  const arrayIntersected = array1.filter(item => !array2.includes(item))
  return arrayIntersected
}
// const a = [2019, 2020, 2023, 2022]
// const b = [2019, 2020, 2021]

// console.log(notIncludesItemArray(a, b))
