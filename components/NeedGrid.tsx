import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useResponsive } from '@/lib/responsive';

// One column on phones; 2–3 columns of cards on wider web screens
export default function NeedGrid({ children, columns: maxColumns }: { children: React.ReactNode; columns?: number }) {
  const { columns: fit } = useResponsive();
  // A narrower container (e.g. next to a sidebar) can cap the number of columns
  const columns = maxColumns ? Math.min(fit, maxColumns) : fit;
  if (columns === 1) return <>{children}</>;
  return (
    <View style={styles.grid}>
      {React.Children.map(children, (child) => (
        <View style={{ width: `${100 / columns}%` }}>{child}</View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
});
