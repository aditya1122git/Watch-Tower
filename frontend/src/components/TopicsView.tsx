import React from 'react';
import { Post } from '../types';
import { Language } from '../i18n';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from 'recharts';

interface TopicsViewProps {
  posts: Post[];
  lang: Language;
}

export const TopicsView: React.FC<TopicsViewProps> = ({ posts, lang }) => {
  // Aggregate topic negative vs positive comment totals
  const topicMap: Record<string, { topic: string; negative: number; positive: number; neutral: number }> = {};

  posts.forEach(p => {
    const t = p.top_topic || 'other';
    if (!topicMap[t]) {
      topicMap[t] = { topic: t, negative: 0, positive: 0, neutral: 0 };
    }
    topicMap[t].negative += p.negative_comment_count;
    topicMap[t].positive += p.positive_comment_count;
    topicMap[t].neutral += p.neutral_comment_count;
  });

  const data = Object.values(topicMap).sort((a, b) => b.negative - a.negative);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          {lang === 'hi' ? 'मुद्दा विश्लेषण (नकारात्मक प्रतिक्रिया के मुख्य कारक)' : 'Key Issue Drivers (Negative vs Positive Polarity)'}
        </h2>
        <p className="text-xs text-slate-500">
          Which issues are driving negative reactions towards the administration right now
        </p>
      </div>

      <div className="h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="topic" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '12px'
              }}
            />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
            <Bar dataKey="negative" name="Negative Comments" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="positive" name="Positive Comments" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
