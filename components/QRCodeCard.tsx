import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

const QRCodeLib = require('qrcode-terminal/vendor/QRCode');
const QRErrorCorrectLevel = require('qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel');

type QRCodeCardProps = {
  label: string;
  value: string;
  payload: string;
  note?: string;
  size?: number;
};

function buildMatrix(payload: string): boolean[][] {
  const qr = new QRCodeLib(-1, QRErrorCorrectLevel.M);
  qr.addData(payload);
  qr.make();
  return qr.modules as boolean[][];
}

function QRGraphic({ payload, size = 148 }: { payload: string; size?: number }) {
  const matrix = buildMatrix(payload);
  const count = matrix.length;
  const quietZone = 4;
  const total = count + quietZone * 2;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${total} ${total}`}>
      <Rect x={0} y={0} width={total} height={total} fill="#ffffff" />
      {matrix.map((row, rowIndex) =>
        row.map((isDark, colIndex) =>
          isDark ? (
            <Rect
              key={`${rowIndex}-${colIndex}`}
              x={colIndex + quietZone}
              y={rowIndex + quietZone}
              width={1}
              height={1}
              fill="#041910"
            />
          ) : null
        )
      )}
    </Svg>
  );
}

export default function QRCodeCard({ label, value, payload, note, size = 148 }: QRCodeCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.qrWrap}>
        <QRGraphic payload={payload} size={size} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.payload}>{payload}</Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 220,
    backgroundColor: '#f8fff0',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d9f99d',
    padding: 16,
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: '#365314',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  qrWrap: {
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
  },
  value: {
    fontSize: 24,
    fontWeight: '800',
    color: '#041910',
    marginBottom: 6,
    letterSpacing: 2,
  },
  payload: {
    fontSize: 10,
    color: '#4b5563',
    textAlign: 'center',
    marginBottom: 8,
  },
  note: {
    fontSize: 12,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 18,
  },
});
