// pages/index.tsx
import AutoCompleteTextArea from '@/components/AutoCompleteTextArea';
import type { NextPage } from 'next';

const Home: NextPage = () => {
  const suggestions = ['Option 1', 'Option 2', 'Option 3'];

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">AutoComplete TextArea Example</h1>
      {/* <AutoCompleteTextArea suggestions={suggestions} /> */}
    </div>
  );
};

export default Home;
