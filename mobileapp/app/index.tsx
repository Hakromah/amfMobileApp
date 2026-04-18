import { Redirect } from 'expo-router';

// We redirect to the unambiguous (landing) group to ensure absolute paths resolve properly anywhere in the app
export default function Index() {
  return <Redirect href={'/(landing)' as any} />;
}
