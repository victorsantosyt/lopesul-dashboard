'use client';
import dynamic from 'next/dynamic';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

export default function EChart({ option, height = 320, className }) {
  return (
    <ReactECharts
      option={option}
      notMerge
      lazyUpdate
      style={{ height, width: '100%' }}
      className={className}
    />
  );
}
