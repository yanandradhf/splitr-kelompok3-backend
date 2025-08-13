const jwt = require( 'jsonwebtoken');
// The secret key must be the same one used to sign the token
const JWT_SECRET = process.env.JWT_SECRET || 'your_very_secure_secret_key';

// Middleware to check if the user is authenticated
const authenticateJWT = (req, res, next) => {
  // Get the token from the Authorization header
  const token = req.cookies.token; 

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
  // 2. Verify the JWT
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Forbidden: Invalid token' });
    }
    req.user = user;
    next();
  });

//   if (authHeader) {
//     const token = authHeader.split(' ')[1]; // Expects 'Bearer <token>'

//     jwt.verify(token, JWT_SECRET, (err, user) => {
//       if (err) {
//         // Token is invalid (e.g., expired or bad signature)
//         return res.status(403).json({ error: 'Forbidden: Invalid token' });
//       }
      
//       // Token is valid, attach user data to the request object
//       req.user = user;
//       next(); // Continue to the next middleware or route handler
//     });
//   } else {
//     // No token provided
//     res.status(401).json({ error: 'Unauthorized: No token provided' });
//   }
};

module.exports=authenticateJWT