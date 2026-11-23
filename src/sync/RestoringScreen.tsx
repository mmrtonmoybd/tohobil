import React from 'react';
import { IonPage, IonContent, IonSpinner } from '@ionic/react';
import { useTranslation } from 'react-i18next';

export const RestoringScreen: React.FC = () => {
  const { t } = useTranslation();

  return (
    <IonPage>
      <IonContent className="shell-content restore-content" fullscreen>
        <div className="restore-container">
          <div className="restore-card">
            <div className="restore-icon-bubble">
              <span className="material-symbols-rounded">cloud_sync</span>
            </div>
            <h1 className="restore-title">{t('sync.restoringTitle')}</h1>
            <p className="restore-subtitle">{t('sync.restoringSubtitle')}</p>
            <div className="restore-spinner-wrap">
              <IonSpinner name="crescent" color="primary" />
            </div>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};
