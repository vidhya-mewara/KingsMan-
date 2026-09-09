import mongoose from 'mongoose';
import initdata from './data.js';
import Player from '../model/playerProfile.js';

const mongoUrl = 'mongodb://127.0.0.1:27017/playerDB';

async function main() {
  await mongoose.connect(mongoUrl);
}

main()
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Error connecting to MongoDB:', err));

const initdb = async () => {
    await Player.deleteMany({});
    console.log('Existing players deleted');
    await Player.insertMany(initdata);
    console.log('Sample players inserted');
  } ;

  initdb();

