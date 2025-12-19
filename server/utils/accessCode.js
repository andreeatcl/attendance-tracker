const ALPHANUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function generateAccessCode(length = 6) {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)];
  }
  return out;
}

module.exports = {
  generateAccessCode,
};
