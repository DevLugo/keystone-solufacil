/** @jsxRuntime classic */
/** @jsx React.createElement */
/** @jsxFrag React.Fragment */

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@keystone-ui/button';
import { LoadingDots } from '@keystone-ui/loading';
import { FaUpload, FaCamera, FaTrash, FaEye, FaExclamationTriangle, FaSyncAlt, FaCheck, FaArrowsAltH } from 'react-icons/fa';
import { Box, Text } from '@keystone-ui/core';

interface ImageUploaderProps {
  onImageUpload: (imageUrl: string, publicId: string) => void;
  onImageRemove?: () => void;
  currentImageUrl?: string;
  currentPublicId?: string;
  disabled?: boolean;
  placeholder?: string;
}

interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  url: string;
  format: string;
  width: number;
  height: number;
  bytes: number;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImageUpload,
  onImageRemove,
  currentImageUrl,
  currentPublicId,
  disabled = false,
  placeholder = 'Subir imagen'
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const [showPreview, setShowPreview] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'error' | 'warning' } | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [currentCamera, setCurrentCamera] = useState<'front' | 'back'>('back'); // Por defecto cámara trasera
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Detectar si estamos en un dispositivo móvil
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Función para obtener las cámaras disponibles
  const getAvailableCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(videoDevices);
      return videoDevices;
    } catch (error) {
      console.error('Error al obtener dispositivos:', error);
      return [];
    }
  };

  // Función para obtener el deviceId de la cámara actual
  const getCameraDeviceId = (cameras: MediaDeviceInfo[], cameraType: 'front' | 'back') => {
    if (cameras.length === 0) return undefined;
    
    // Buscar cámara trasera (back) por defecto
    if (cameraType === 'back') {
      // Intentar encontrar cámara trasera por label
      const backCamera = cameras.find(camera => 
        camera.label.toLowerCase().includes('back') || 
        camera.label.toLowerCase().includes('rear') ||
        camera.label.toLowerCase().includes('environment')
      );
      if (backCamera) return backCamera.deviceId;
      
      // Si no se encuentra, usar la primera cámara (generalmente la trasera en móviles)
      return cameras[0].deviceId;
    } else {
      // Buscar cámara frontal (front)
      const frontCamera = cameras.find(camera => 
        camera.label.toLowerCase().includes('front') || 
        camera.label.toLowerCase().includes('user') ||
        camera.label.toLowerCase().includes('facing')
      );
      if (frontCamera) return frontCamera.deviceId;
      
      // Si no se encuentra, usar la segunda cámara (generalmente la frontal en móviles)
      return cameras.length > 1 ? cameras[1].deviceId : cameras[0].deviceId;
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      setMessage({ text: 'Por favor selecciona un archivo de imagen válido', tone: 'warning' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    // Validar tamaño (10MB máximo)
    if (file.size > 10 * 1024 * 1024) {
      setMessage({ text: 'El archivo es demasiado grande. Máximo 10MB', tone: 'warning' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    // Crear preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Subir a Cloudinary
    try {
      setIsUploading(true);
      
      // Subir a Cloudinary a través del endpoint de API
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'documentos-personales');

      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Error al subir la imagen');
      }

      const result: CloudinaryUploadResult = await response.json();
      
      // Llamar al callback con la URL y public_id
      onImageUpload(result.secure_url, result.public_id);
      
    } catch (error) {
      console.error('Error al subir imagen:', error);
      setMessage({ text: 'Error al subir la imagen. Por favor, inténtalo de nuevo.', tone: 'error' });
      setTimeout(() => setMessage(null), 5000);
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = () => {
    setPreviewUrl(null);
    setShowPreview(false);
    if (onImageRemove) {
      onImageRemove();
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCapturePhoto = async () => {
    if (isMobile) {
      // En móviles, usar input file con capture para abrir la app nativa de cámara
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    } else {
      // En desktop, usar la cámara web como antes
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          // Obtener cámaras disponibles
          const cameras = await getAvailableCameras();
          const deviceId = getCameraDeviceId(cameras, currentCamera);
          
          // Configuración para usar la cámara nativa del dispositivo móvil
          const constraints = {
            video: {
              deviceId: deviceId ? { exact: deviceId } : undefined,
              width: { ideal: 1920, min: 1280 },
              height: { ideal: 1080, min: 720 },
              frameRate: { ideal: 30, min: 15 },
              // Habilitar funciones avanzadas de la cámara nativa
              facingMode: currentCamera === 'back' ? 'environment' : 'user',
              // Configuraciones para mejor calidad en móviles
              aspectRatio: { ideal: 16/9 },
              // Habilitar enfoque automático y otras funciones
              focusMode: 'continuous',
              whiteBalanceMode: 'continuous',
              exposureMode: 'continuous'
            }
          };

          const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
          
          setStream(mediaStream);
          setShowCamera(true);
          
          // Esperar a que el DOM se actualice antes de inicializar el video
          setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.srcObject = mediaStream;
              // Forzar la reproducción del video
              videoRef.current.play().catch(e => {
                console.log('Error al reproducir video:', e);
                setCameraError('Error al reproducir el video de la cámara');
              });
            }
          }, 100);
          
        } catch (error) {
          console.error('Error al acceder a la cámara:', error);
          alert('No se pudo acceder a la cámara. Asegúrate de dar permisos y que no esté siendo usada por otra aplicación.');
        }
      } else {
        alert('Tu navegador no soporta la captura de fotos');
      }
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        // Configurar canvas con las dimensiones del video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Dibujar el frame actual del video en el canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convertir canvas a blob
        canvas.toBlob(async (blob) => {
          if (blob) {
            // Crear archivo desde el blob
            const file = new File([blob], 'foto-capturada.jpg', { type: 'image/jpeg' });
            
            // Crear preview
            const reader = new FileReader();
            reader.onload = (e) => {
              setPreviewUrl(e.target?.result as string);
            };
            reader.readAsDataURL(file);
            
            // Subir a Cloudinary
            try {
              setIsUploading(true);
              
              const formData = new FormData();
              formData.append('file', file);
              formData.append('folder', 'documentos-personales');

              const response = await fetch('/api/upload-image', {
                method: 'POST',
                body: formData,
              });

              if (!response.ok) {
                throw new Error('Error al subir la imagen');
              }

              const result: CloudinaryUploadResult = await response.json();
              
              // Llamar al callback con la URL y public_id
              onImageUpload(result.secure_url, result.public_id);
              
            } catch (error) {
              console.error('Error al subir imagen capturada:', error);
              setMessage({ text: 'Error al subir la imagen capturada. Por favor, inténtalo de nuevo.', tone: 'error' });
              setTimeout(() => setMessage(null), 5000);
              setPreviewUrl(null);
            } finally {
              setIsUploading(false);
            }
          }
        }, 'image/jpeg', 0.9);
      }
    }
    
    // Cerrar cámara
    closeCamera();
  };

  const closeCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setShowCamera(false);
    setIsCameraReady(false);
    setCameraError(null);
  };

  // Función para cambiar entre cámaras
  const switchCamera = async () => {
    if (!showCamera) return;
    
    const newCamera = currentCamera === 'front' ? 'back' : 'front';
    setCurrentCamera(newCamera);
    
    // Cerrar stream actual
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    
    try {
      // Obtener cámaras disponibles
      const cameras = await getAvailableCameras();
      const deviceId = getCameraDeviceId(cameras, newCamera);
      
      const constraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 30, min: 15 },
          // Habilitar funciones avanzadas de la cámara nativa
          facingMode: newCamera === 'back' ? 'environment' : 'user',
          // Configuraciones para mejor calidad en móviles
          aspectRatio: { ideal: 16/9 },
          // Habilitar enfoque automático y otras funciones
          focusMode: 'continuous',
          whiteBalanceMode: 'continuous',
          exposureMode: 'continuous'
        }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      
      // Actualizar el video element
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(e => {
          console.log('Error al reproducir video:', e);
          setCameraError('Error al reproducir el video de la cámara');
        });
      }
    } catch (error) {
      console.error('Error al cambiar cámara:', error);
      setMessage({ text: 'Error al cambiar de cámara', tone: 'error' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  // Limpiar stream cuando se desmonte el componente
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  return (
    <div style={{ width: '100%' }}>
      {/* Message */}
      {message && (
        <Box
          style={{
            marginBottom: '12px',
            padding: '8px 12px',
            backgroundColor: message.tone === 'success' ? '#f0f9ff' : 
                            message.tone === 'error' ? '#fef2f2' : '#fef3c7',
            borderLeft: `4px solid ${
              message.tone === 'success' ? '#0ea5e9' : 
              message.tone === 'error' ? '#dc2626' : '#d97706'
            }`,
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {message.tone === 'success' && <FaCheck color="#0ea5e9" size={14} />}
          {message.tone === 'error' && <FaExclamationTriangle color="#dc2626" size={14} />}
          {message.tone === 'warning' && <FaExclamationTriangle color="#d97706" size={14} />}
          <Text 
            size="small" 
            color={message.tone === 'success' ? 'blue600' : 
                   message.tone === 'error' ? 'red600' : 'orange600'}
          >
            {message.text}
          </Text>
        </Box>
      )}

      {/* Input de archivo oculto */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture={isMobile ? (currentCamera === 'back' ? 'environment' : 'user') : undefined}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={disabled || isUploading}
      />

      {/* Preview de imagen */}
      {previewUrl && (
        <div style={{
          marginBottom: '12px',
          position: 'relative',
          display: 'inline-block'
        }}>
          <img
            src={previewUrl}
            alt="Preview"
            style={{
              maxWidth: '200px',
              maxHeight: '150px',
              borderRadius: '6px',
              border: '1px solid #E5E7EB',
              cursor: 'pointer'
            }}
            onClick={() => setShowPreview(!showPreview)}
          />
          
          {/* Botones de acción sobre la imagen */}
          <div style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            display: 'flex',
            gap: '4px'
          }}>
            <Button
              tone="passive"
              size="small"
              onClick={() => setShowPreview(!showPreview)}
              style={{ padding: '4px', minWidth: 'auto' }}
              title="Ver imagen"
            >
              <FaEye size={10} />
            </Button>
            <Button
              tone="negative"
              size="small"
              onClick={handleRemoveImage}
              style={{ padding: '4px', minWidth: 'auto' }}
              title="Eliminar imagen"
            >
              <FaTrash size={10} />
            </Button>
          </div>
        </div>
      )}

      {/* Modal de preview */}
      {showPreview && previewUrl && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            position: 'relative',
            maxWidth: '90vw',
            maxHeight: '90vh'
          }}>
            <img
              src={previewUrl}
              alt="Preview"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                borderRadius: '8px'
              }}
            />
            <Button
              tone="negative"
              size="small"
              onClick={() => setShowPreview(false)}
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0',
                padding: '8px 12px'
              }}
            >
              Cerrar
            </Button>
          </div>
        </div>
      )}

      {/* Modal de cámara */}
      {showCamera && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: '500px',
            textAlign: 'center'
          }}>
            {/* Título */}
            <div style={{
              color: 'white',
              fontSize: '18px',
              fontWeight: 'bold',
              marginBottom: '8px'
            }}>
              Capturar Foto
            </div>
            
            
            {/* Video de la cámara */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              controls={false}
              style={{
                width: '100%',
                maxWidth: '400px',
                borderRadius: '8px',
                border: '2px solid #fff',
                backgroundColor: '#000'
              }}
              onLoadedMetadata={() => {
                // Forzar la reproducción cuando se carguen los metadatos
                if (videoRef.current) {
                  videoRef.current.play().catch(e => {
                    console.log('Error al reproducir video:', e);
                    setCameraError('Error al reproducir el video de la cámara');
                  });
                }
              }}
              onCanPlay={() => {
                // Asegurar que el video esté reproduciéndose
                if (videoRef.current && videoRef.current.paused) {
                  videoRef.current.play().catch(e => {
                    console.log('Error al reproducir video:', e);
                    setCameraError('Error al reproducir el video de la cámara');
                  });
                }
                setIsCameraReady(true);
                setCameraError(null);
              }}
              onError={() => {
                setCameraError('Error al cargar el video de la cámara');
                setIsCameraReady(false);
              }}
            />
            
            {/* Botón para cambiar de cámara - Solo en desktop */}
            {!isMobile && availableCameras.length > 1 && (
              <div style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                zIndex: 10
              }}>
                <button
                  onClick={switchCamera}
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
                    e.currentTarget.style.transform = 'scale(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  title={`Cambiar a cámara ${currentCamera === 'front' ? 'trasera' : 'frontal'}`}
                >
                  <FaArrowsAltH size={16} />
                </button>
              </div>
            )}
            
            {/* Indicador de estado de la cámara */}
            {!isCameraReady && !cameraError && (
              <div style={{
                color: '#fbbf24',
                fontSize: '14px',
                marginTop: '8px'
              }}>
                Inicializando cámara...
              </div>
            )}
            
            {cameraError && (
              <div style={{
                color: '#ef4444',
                fontSize: '14px',
                marginTop: '8px',
                padding: '8px',
                backgroundColor: '#fef2f2',
                borderRadius: '4px',
                border: '1px solid #fecaca'
              }}>
                ⚠️ {cameraError}
                <Button
                  tone="passive"
                  size="small"
                  onClick={() => {
                    setCameraError(null);
                    setIsCameraReady(false);
                    if (videoRef.current) {
                      videoRef.current.play().catch(e => {
                        console.log('Error al reproducir video:', e);
                      });
                    }
                  }}
                  style={{
                    marginLeft: '8px',
                    padding: '4px 8px',
                    fontSize: '12px'
                  }}
                >
                  Reintentar
                </Button>
              </div>
            )}
            
            {/* Canvas oculto para captura */}
            <canvas
              ref={canvasRef}
              style={{ display: 'none' }}
            />
            
            {/* Botones de control */}
            <div style={{
              display: 'flex',
              gap: '16px',
              justifyContent: 'center',
              marginTop: '20px'
            }}>
              <Button
                tone="negative"
                size="medium"
                onClick={closeCamera}
                style={{
                  padding: '12px 24px',
                  fontSize: '14px'
                }}
              >
                Cancelar
              </Button>
              
              <Button
                tone="active"
                size="medium"
                onClick={capturePhoto}
                disabled={isUploading || !isCameraReady || !!cameraError}
                style={{
                  padding: '12px 24px',
                  fontSize: '14px',
                  backgroundColor: isCameraReady && !cameraError ? '#0ea5e9' : '#9ca3af',
                  color: 'white',
                  border: 'none'
                }}
              >
                {isUploading ? 'Capturando...' : '📸 Capturar'}
              </Button>
            </div>
            
            {/* Instrucciones */}
            <div style={{
              color: '#9ca3af',
              fontSize: '14px',
              marginTop: '16px',
              padding: '0 20px',
              textAlign: 'center'
            }}>
              {isMobile ? (
                <>
                  📱 Se abrirá la app nativa de cámara
                  <br />
                  Toma la foto y regresará automáticamente
                  <br />
                  <small style={{ opacity: 0.7 }}>
                    (Todas las funciones nativas disponibles)
                  </small>
                </>
              ) : (
                'Posiciona el documento en el centro de la pantalla y presiona "Capturar"'
              )}
            </div>
          </div>
        </div>
      )}

      {/* Botones de acción */}
      <div style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap'
      }}>
        <Button
          tone="active"
          size="small"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          style={{ fontSize: '12px' }}
        >
          {isUploading ? (
            <LoadingDots label="Subiendo" size="small" />
          ) : (
            <>
              <FaUpload size={12} style={{ marginRight: '6px' }} />
              {placeholder}
            </>
          )}
        </Button>

        <Button
          tone="passive"
          size="small"
          onClick={handleCapturePhoto}
          disabled={disabled || isUploading}
          style={{ 
            fontSize: '12px',
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none'
          }}
        >
          <FaCamera size={12} style={{ marginRight: '6px' }} />
          {isMobile ? '📱 Cámara' : 'Cámara'}
        </Button>

        {previewUrl && (
          <Button
            tone="negative"
            size="small"
            onClick={handleRemoveImage}
            disabled={disabled || isUploading}
            style={{ fontSize: '12px' }}
          >
            <FaTrash size={12} style={{ marginRight: '6px' }} />
            Eliminar
          </Button>
        )}
      </div>

      {/* Información de la imagen actual */}
      {currentImageUrl && !previewUrl && (
        <div style={{
          marginTop: '8px',
          padding: '8px',
          backgroundColor: '#F0F9FF',
          borderRadius: '4px',
          fontSize: '12px',
          color: '#6B7280'
        }}>
          Imagen actual: {currentImageUrl.split('/').pop()}
        </div>
      )}
    </div>
  );
};
