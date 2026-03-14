// app/components/SimpleChart.tsx
import React from 'react';
import { View, Text, StyleSheet, Dimensions,ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface SimpleLineChartProps {
  data: Array<{ date: string; sales: number; earnings: number }>;
  height?: number;
}

export function SimpleLineChart({ data, height = 200 }: SimpleLineChartProps) {
  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.emptyText}>No data available</Text>
      </View>
    );
  }

  const maxValue = Math.max(...data.map(d => Math.max(d.sales, d.earnings)), 1);
  const chartWidth = Math.max(width - 64, data.length * 40);

  return (
    <View style={[styles.container, { height }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ width: chartWidth, height }}>
          {/* Grid lines */}
          {[0.25, 0.5, 0.75, 1].map((ratio, i) => (
            <View
              key={i}
              style={[
                styles.gridLine,
                { top: height * (1 - ratio) },
              ]}
            >
              <Text style={styles.gridLabel}>
                ₦{Math.round(maxValue * ratio).toLocaleString()}
              </Text>
            </View>
          ))}

          {/* Bars */}
          <View style={styles.barsContainer}>
            {data.map((item, index) => {
              const salesHeight = (item.sales / maxValue) * (height - 40);
              const earningsHeight = (item.earnings / maxValue) * (height - 40);
              
              return (
                <View key={index} style={styles.barGroup}>
                  <View style={styles.barPair}>
                    <View
                      style={[
                        styles.bar,
                        styles.salesBar,
                        { height: salesHeight },
                      ]}
                    />
                    <View
                      style={[
                        styles.bar,
                        styles.earningsBar,
                        { height: earningsHeight },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel} numberOfLines={1}>
                    {item.date}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.salesBar]} />
          <Text style={styles.legendText}>Revenue</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, styles.earningsBar]} />
          <Text style={styles.legendText}>Your Earnings</Text>
        </View>
      </View>
    </View>
  );
}

interface SimpleBarChartProps {
  data: Array<{ label: string; value: number }>;
  height?: number;
}

export function SimpleBarChart({ data, height = 200 }: SimpleBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={styles.emptyText}>No data available</Text>
      </View>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value), 1);
  const chartWidth = Math.max(width - 64, data.length * 60);

  return (
    <View style={[styles.container, { height }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ width: chartWidth, height }}>
          {/* Grid lines */}
          {[0.25, 0.5, 0.75, 1].map((ratio, i) => (
            <View
              key={i}
              style={[
                styles.gridLine,
                { top: height * (1 - ratio) },
              ]}
            >
              <Text style={styles.gridLabel}>
                {Math.round(maxValue * ratio)}
              </Text>
            </View>
          ))}

          {/* Bars */}
          <View style={styles.barsContainer}>
            {data.map((item, index) => {
              const barHeight = (item.value / maxValue) * (height - 40);
              
              return (
                <View key={index} style={styles.barGroup}>
                  <View style={styles.singleBarContainer}>
                    <View
                      style={[
                        styles.bar,
                        styles.primaryBar,
                        { height: barHeight },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel} numberOfLines={1}>
                    {item.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginVertical: 10,
  },
  gridLine: {
    position: 'absolute',
    left: 40,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  gridLabel: {
    position: 'absolute',
    left: -35,
    top: -6,
    fontSize: 9,
    color: '#666',
    width: 30,
    textAlign: 'right',
  },
  barsContainer: {
    position: 'absolute',
    top: 0,
    left: 40,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
  },
  barGroup: {
    alignItems: 'center',
    width: 40,
  },
  barPair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
  },
  singleBarContainer: {
    width: 30,
    alignItems: 'center',
  },
  bar: {
    width: 12,
    borderRadius: 4,
  },
  salesBar: {
    backgroundColor: '#3b82f6',
  },
  earningsBar: {
    backgroundColor: '#f97316',
  },
  primaryBar: {
    backgroundColor: '#f97316',
    width: 20,
  },
  barLabel: {
    fontSize: 9,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
    width: 50,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 11,
    color: '#666',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 40,
  },
});