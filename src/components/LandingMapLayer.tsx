import React from 'react';
import { motion } from 'framer-motion';
import MapBackground from '../components/MapBackground';

interface Props {
    mapScale: any; // motion value
}

const LandingMapLayer: React.FC<Props> = ({ mapScale }) => {
    return (
        <motion.div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                scale: mapScale,
                pointerEvents: 'auto',
                zIndex: 1,
            }}
        >
            <MapBackground />
        </motion.div>
    );
};

export default LandingMapLayer;
