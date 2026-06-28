import { execute } from '../db.js';

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error('Usage: node deleteCustomerChat.js <customerPublicId>');
    process.exit(1);
  }

  try {
    const res = await execute('DELETE FROM chat_messages WHERE customer_public_id = ?', [id]);
    console.log(`Deleted chat messages for customer ${id}. Result:`, res);
    process.exit(0);
  } catch (err) {
    console.error('Error deleting messages:', err.message || err);
    process.exit(2);
  }
}

main();
