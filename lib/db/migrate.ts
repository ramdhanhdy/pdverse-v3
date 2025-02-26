import { db } from './index';

console.log('Running database migrations...');

// The database is automatically initialized when imported from './index'
// This script is just a wrapper to run the initialization explicitly

// Run additional migrations
import './migrations/add_full_text_search';

console.log('Database migrations completed successfully!');
