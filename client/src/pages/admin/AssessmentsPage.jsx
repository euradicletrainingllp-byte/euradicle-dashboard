import React from 'react';
import { motion } from 'framer-motion';
import { Construction } from 'lucide-react';

export default function AssessmentsPage() {
  return (
    <div className="p-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-16 text-center max-w-lg mx-auto mt-12">
        <Construction size={48} style={{ color: '#aa78a6' }} className="mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2" style={{ color: '#f0e8fc' }}>Assessments</h2>
        <p className="text-sm" style={{ color: '#7060a0' }}>Sprint 2–4 implementation in progress.<br/>Schema and API are ready.</p>
      </motion.div>
    </div>
  );
}
